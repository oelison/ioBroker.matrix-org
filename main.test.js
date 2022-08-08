"use strict";

/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.js-files
 */

// tslint:disable:no-unused-expression

const { assert } = require("assertthat");
// import { functionToTest } from "./moduleToTest";

suite("module to test => function to test", () => {
// initializing logic
    const expected = 5;

    test(`if test return ${expected}.`, done => {
        const result = 5;
        // assign result a value from functionToTest
        assert.that(result).is.equalTo(expected);
        done();
    });
    // ... more tests => it

});

// ... more test suites => describe
