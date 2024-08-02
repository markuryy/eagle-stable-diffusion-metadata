# Eagle App Plugin for Stable Diffusion Metadata

The Stable Diffusion Metadata extension for Eagle App brings the raw metadata from your Stable Diffusion images directly to Eagle's info panel, making it easy to view important details without leaving your library. 

Please download from the [Eagle Plugin store](https://community-en.eagle.cool/plugin/9b7b7587-00d7-4bf4-ae13-55d46796caf8). Use the example image (example.png) in this repo to test the plugin.

## Background

Stable Diffusion is an open-source AI image generation pipeline that requires a webUI like A1111, ComfyUI, or WebUI Forge to run inference. These programs use different metadata formats that can be difficult to read in other applications. This extension bridges that gap by displaying the metadata in a user-friendly format within Eagle App.

## Features

- Displays Stable Diffusion metadata directly in Eagle's info panel
- Allows expansion of truncated metadata for images with extensive information
- Provides option to download the entire metadata as a JSON file
- Enables appending metadata to the image's notes within Eagle
- Includes a bulk update feature to add metadata to notes for all Stable Diffusion images in the library

## Technical Approach

### Metadata Storage in Stable Diffusion Images

Stable Diffusion images typically store metadata within PNG chunks. The PNG file format allows for custom chunks that can contain arbitrary data. Stable Diffusion web UIs commonly use two types of chunks for metadata:

1. `tEXt` (Textual data): This chunk type stores uncompressed metadata as key-value pairs.
2. `zTXt` (Compressed textual data): Similar to `tEXt`, but the value is compressed using zlib compression.

The metadata is usually stored with keys like "parameters", "prompt", "negative_prompt", etc., depending on the specific Stable Diffusion web UI used to generate the image.

### Reading Metadata

The plugin reads metadata from PNG files using the following approach:

1. It reads the PNG file as a binary buffer.
2. The buffer is scanned for `tEXt` and `zTXt` chunks.
3. For each chunk found:
   - The chunk type is identified.
   - The length of the chunk data is read.
   - The chunk data is extracted.
   - For `zTXt` chunks, the data is decompressed using zlib.
   - The key-value pair is parsed and added to a metadata object.

This approach allows the plugin to read metadata regardless of the specific Stable Diffusion web UI used to generate the image, as long as it follows the standard PNG chunk format for storing metadata.

### Metadata Processing

Once the metadata is read, it undergoes several processing steps:

1. The metadata object is converted to a JSON string for easy manipulation.
2. The JSON string is "cleaned" by:
   - Removing outer curly braces
   - Replacing escaped newlines (`\n`) with actual newline characters
   - Replacing escaped quotes (`\"`) with regular quotes
   - Trimming any leading/trailing whitespace

This processing ensures that the metadata is displayed in a readable format and can be easily appended to the image's notes within Eagle.

## Implementation Details

The plugin is implemented using JavaScript and leverages Eagle's plugin API. Key components include:

- `ImageDataReader` class: Handles the reading and parsing of PNG metadata.
- `cleanMetadata` function: Processes the raw metadata string for improved readability.
- Event listeners for user interactions: Manage expanding/collapsing metadata, exporting raw metadata, appending to notes, and bulk updates.

The plugin uses asynchronous operations to handle file reading and writing, ensuring responsive performance even with large libraries.

## Future Improvements

Potential areas for future development include:

- Support for additional metadata formats used by other Stable Diffusion web UIs
- Enhanced metadata visualization options
- Integration with Eagle's search functionality for metadata contents

Contributions and suggestions for improvements are welcome!