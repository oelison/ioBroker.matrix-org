'use strict';

//const { basename } = require('path');
//const { URL } = require('url');
//const Os = require('os');

import * as basename from 'path';
import * as URL from 'url';
import * as Os from 'os';

/**
 * windows detector (file position)
 *
 * @returns true on windows
 */
export function isWindows() {
    return Os.platform() === 'win32';
}
/**
 * Get the basename of a path or URL to a file.
 *
 * @param file Path or URL to a file.
 * @returns The basename of the file.
 */
export function getBasenameFromFilePathOrUr(file) {
    if (file.match(/^\w+:\/\//)) {
        try {
            const url = new URL(file);
            return basename(url.pathname);
        } catch (err) {
            this.log.error(err);
            return basename(file);
        }
    } else {
        return basename(file);
    }
}

/**
 * Get a buffer and a file name from a possibly base64 encoded string.
 *
 * @param base64Object The possibly bas64 encoded data string.
 * @returns Object of `buffer` and `name` from the base64 string or null if no base64 string.
 */
export function getBufferAndNameFromBase64Object(base64Object) {
    if (typeof base64Object === 'object') {
        if (base64Object.base64) {
            let mimeType = undefined;
            if (base64Object.type) {
                mimeType = String(base64Object.type);
            }
            const buffer = Buffer.from(base64Object.base64, 'base64');
            return {
                buffer,
                mimeType,
            };
        }

        return null;
    }

    return null;
}
/**
 * Get a buffer and a file name from a possibly base64 encoded string.
 *
 * @param base64String The possibly bas64 encoded data string.
 * @returns Object of `buffer` and `name` from the base64 string or null if no base64 string.
 */
export function getBufferAndNameFromBase64String(base64String) {
    const b64match = base64String.match(/^data:([^/]+)\/([^;]+);base64,([a-zA-Z0-9+/]+=*)$/);
    if (!b64match) {
        return null;
    }
    // base64 encoded content
    const buffer = Buffer.from(b64match[3], 'base64');

    // get mime type
    const mimeType = `${b64match[1].replace(/\W/g, '_')}/${b64match[2].replace(/\W/g, '_')}`;
    return {
        buffer,
        mimeType,
    };
}

/**
 * try to get the image type from the data
 *
 * @param buffer image data
 * @returns the guessed image type
 */
export function getFileTypeFromData(buffer) {
    let imageType = '';
    if (buffer.length > 4) {
        const header =
            buffer[0].toString(16) + buffer[1].toString(16) + buffer[2].toString(16) + buffer[3].toString(16);
        switch (header) {
            case '89504e47':
                imageType = 'image/png';
                break;
            case '47494638':
                imageType = 'image/gif';
                break;
            case 'ffd8ffe0':
            case 'ffd8ffe1':
            case 'ffd8ffe2':
            case 'ffd8ffe3':
            case 'ffd8ffe8':
                imageType = 'image/jpeg';
                break;
            default:
                imageType = 'unknown'; // Or you can use the blob.type as fallback
                this.log.warn('getFileType, No type detected, use type manualy.');
                break;
        }
    } else {
        this.log.error(`getFileType, length to low: ${buffer.length}`);
    }
    return imageType;
}
