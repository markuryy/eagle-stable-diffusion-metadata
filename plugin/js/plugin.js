const fs = require('fs');
const zlib = require('zlib');

class ImageDataReader {
  constructor(filePath) {
    this.filePath = filePath;
    this.metadata = {};
  }

  readData(callback) {
    fs.readFile(this.filePath, (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return callback('FAIL', {});
      }
      try {
        if (data.toString('ascii', 1, 4) !== 'PNG') {
          throw new Error('Not a PNG file');
        }
        let offset = 8;
        while (offset < data.length) {
          let length = data.readUInt32BE(offset);
          let type = data.toString('ascii', offset + 4, offset + 8);
          if (type === 'tEXt' || type === 'zTXt') {
            let textData = data.slice(offset + 8, offset + 8 + length);
            let text = (type === 'tEXt') ? textData.toString('ascii') : this.decompressText(textData);
            let [keyword, value] = text.split('\0');
            this.metadata[keyword] = value;
          }
          offset += (length + 12);
        }
        callback('SUCCESS', this.metadata);
      } catch (parseError) {
        console.error('Error parsing PNG metadata:', parseError);
        return callback('FAIL', {});
      }
    });
  }

  decompressText(data) {
    try {
      let compressionMethod = data.readInt8(0);
      if (compressionMethod !== 0) {
        throw new Error('Unsupported compression method');
      }
      let compressedData = data.slice(1);
      let decompressedData = zlib.inflateSync(compressedData);
      return decompressedData.toString();
    } catch (error) {
      console.error('Error decompressing zTXt chunk:', error);
      return 'Error decompressing metadata';
    }
  }
}

eagle.onPluginCreate(async (plugin) => {
  try {
    const selectedItem = await eagle.item.getSelected();
    if (!selectedItem || selectedItem.length === 0 || !selectedItem[0].filePath) {
      console.error('No item selected or item path is not provided');
      return;
    }
    const reader = new ImageDataReader(selectedItem[0].filePath);
    reader.readData((status, metadata) => {
      if (status === 'SUCCESS') {
        const metadataElement = document.getElementById('metadata');
        const fullMetadataString = JSON.stringify(metadata, null, 2);
        const cleanFullMetadata = cleanMetadata(fullMetadataString);
        const truncatedMetadata = truncateString(cleanFullMetadata, 500);
        metadataElement.textContent = truncatedMetadata;
        setupUI(cleanFullMetadata, truncatedMetadata, selectedItem[0].id);
      } else {
        console.error('Failed to read metadata');
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

function setupUI(fullText, truncatedText, itemId) {
  const toggleButton = document.getElementById('toggleButton');
  const metadataElement = document.getElementById('metadata');
  const appendToNotesButton = document.getElementById('appendToNotesButton');
  const moreOptionsButton = document.getElementById('moreOptionsButton');
  let isExpanded = false;

  toggleButton.addEventListener('click', () => {
    isExpanded = !isExpanded;
    metadataElement.textContent = isExpanded ? fullText : truncatedText;
    toggleButton.textContent = isExpanded ? 'Collapse' : 'Expand';
    metadataElement.style.maxHeight = isExpanded ? 'none' : '150px';
  });

  document.getElementById('downloadButton').addEventListener('click', async () => {
    let saveResult = await eagle.dialog.showSaveDialog({
      title: "Save Metadata",
      defaultPath: "metadata.json",
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!saveResult.canceled && saveResult.filePath) {
      fs.writeFile(saveResult.filePath, fullText, (err) => {
        if (err) {
          console.error('Error writing metadata file:', err);
        }
      });
    }
  });

  appendToNotesButton.addEventListener('click', async () => {
    await appendMetadataToNotes(itemId, fullText);
  });

  moreOptionsButton.addEventListener('click', () => {
    eagle.contextMenu.open([
      {
        id: "bulkUpdate",
        label: "Bulk Update All Items",
        click: async () => {
          const result = await eagle.dialog.showMessageBox({
            type: 'question',
            buttons: ['Yes', 'No'],
            title: 'Confirm Bulk Update',
            message: 'This will append metadata to notes for all Stable Diffusion images in your library. This may take a while and is not recommended if you have ComfyUI images. Do you want to continue?'
          });

          if (result.response === 0) { // User clicked 'Yes'
            await bulkUpdateNotes();
          }
        }
      }
    ]);
  });
}

async function appendMetadataToNotes(itemId, metadata) {
  try {
    const item = await eagle.item.getById(itemId);
    const currentAnnotation = item.annotation || '';
    
    // Check if metadata is already in the notes
    if (currentAnnotation.includes(metadata)) {
      console.log('Metadata already exists in notes. Skipping append.');
      return;
    }
    
    const updatedAnnotation = currentAnnotation + (currentAnnotation ? '\n\n' : '') + metadata;
    item.annotation = updatedAnnotation;
    await item.save();
    console.log('Metadata appended to notes successfully');
  } catch (error) {
    console.error('Error appending metadata to notes:', error);
  }
}

async function bulkUpdateNotes() {
  try {
    const allItems = await eagle.item.getAll();
    let updatedCount = 0;

    for (const item of allItems) {
      if (item.ext.toLowerCase() === 'png') {
        const reader = new ImageDataReader(item.filePath);
        await new Promise((resolve) => {
          reader.readData(async (status, metadata) => {
            if (status === 'SUCCESS' && Object.keys(metadata).length > 0) {
              const metadataString = JSON.stringify(metadata, null, 2);
              const cleanMetadataString = cleanMetadata(metadataString);
              const currentAnnotation = item.annotation || '';
              
              // Check if metadata is already in the notes
              if (!currentAnnotation.includes(cleanMetadataString)) {
                const updatedAnnotation = currentAnnotation + (currentAnnotation ? '\n\n' : '') + cleanMetadataString;
                item.annotation = updatedAnnotation;
                await item.save();
                updatedCount++;
              }
            }
            resolve();
          });
        });
      }
    }

    console.log(`Bulk update completed. Updated ${updatedCount} items.`);
    await eagle.dialog.showMessageBox({
      type: 'info',
      title: 'Bulk Update Completed',
      message: `Updated ${updatedCount} items with Stable Diffusion metadata.`
    });
  } catch (error) {
    console.error('Error during bulk update:', error);
  }
}

function truncateString(str, maxLength) {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function cleanMetadata(metadata) {
  return metadata
    .replace(/^\{|\}$/g, '') // Remove outer curly braces
    .replace(/\\n/g, '\n') // Replace \n with actual newlines
    .replace(/\\"/g, '"') // Replace \" with "
    .trim(); // Trim any leading/trailing whitespace
}