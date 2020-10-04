# PR Comment Templates
## What it does
This script adds a dropdown in the comment interface that allows for the selection of a template to overwrite the contents of the editor.

## How to customize
To customize, edit the `TEMPLATES` array. 

Each object in the array should have:
  * a `name`, which specifies the text displayed in the dropdown
  * an `output`, which specifies the text to apply to the editor below

Multiline strings and emojis are supported.