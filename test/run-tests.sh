#!/bin/bash
cd "$(dirname "$0")/.."
npm install jsdom fake-indexeddb --no-save
node test/data-tests.js
