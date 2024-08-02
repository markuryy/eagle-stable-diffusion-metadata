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
        setupUI(cleanFullMetadata, truncatedMetadata);
      } else {
        console.error('Failed to read metadata');
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

function setupUI(fullText, truncatedText) {
  const toggleButton = document.getElementById('toggleButton');
  const metadataElement = document.getElementById('metadata');
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
}

function truncateString(str, maxLength) {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function cleanMetadata(metadata) {
  return metadata.replace(/\\/g, '').replace(/^\{|\}$/g, '');
}