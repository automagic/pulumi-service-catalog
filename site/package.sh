#! /usr/bin/env bash

vite build
cp -r ../pre-build-lambda-assets/. ./build/

cd build
npm ci --omit dev

zip -r ../site.zip .