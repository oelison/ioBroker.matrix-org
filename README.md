![Logo](admin/matrix-logo.png)
# ioBroker.matrix-org

[![NPM version](https://img.shields.io/npm/v/iobroker.matrix-org.svg)](https://www.npmjs.com/package/iobroker.matrix-org)
[![Downloads](https://img.shields.io/npm/dm/iobroker.matrix-org.svg)](https://www.npmjs.com/package/iobroker.matrix-org)
![Number of Installations](https://iobroker.live/badges/matrix-org-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/matrix-org-stable.svg)
[![Dependency Status](https://img.shields.io/david/oelison/iobroker.matrix-org.svg)](https://david-dm.org/oelison/iobroker.matrix-org)

[![NPM](https://nodei.co/npm/iobroker.matrix-org.png?downloads=true)](https://nodei.co/npm/iobroker.matrix-org/)

**Tests:** ![Test and Release](https://github.com/oelison/ioBroker.matrix-org/workflows/Test%20and%20Release/badge.svg)

## matrix-org adapter for ioBroker

Adapter for matrix push messages
Big thanks for creating matrix (https://matrix.org/) for creating a full free communication base

### Configuration

Best: Run your own client on your server!

Create an own user as your BOT with password. Create a room for all members who want the bot messages. Add your BOT to this room. Add all members to this room. Put all the data into the config. (BOT name, password, room name)

### Usage

Add as many instances as you need. Add a value to matrix-org.0.sendMessage on the way you like, with js
Or use: sendTo("matrix-org.0", "Hello World!"); in js
Or use the blockly symbol in Sendto

### to test your configuration use sendMessage

simply open the objects and change the string of one matrix-org instance

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* sendMessage stay in for fast config testing
* index_m.html and files from admin/build removed
* password encryption and protection enabled
* password field now as type password
* detection of missing config give an error log
* detection of unread room data give an error log
* encodeURI() used where possible
* catching termination during await for avoid errors when writing on ioBroker database

### 0.0.4 (2022-07-02)
* blockly added
* onMessage method added

### 0.0.3 (2022-06-26)
* Invalid workflow line 54 in test-and-release.yml (leading space removed)

### 0.0.2 (2022-06-26)
* (oelison) message sending by setting object sendMessage implemented
* (oelison) most "try/catch" done
* (oelison) Readme completed.

### 0.0.1 (2022-06-26)
* (oelison) initial release

## License
MIT License

Copyright (c) 2022 Christian Oelschlegel <iobrokermatrix@sciphy.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.