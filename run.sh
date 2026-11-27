#!/bin/bash
git pull
npm install
npm run build
PORT=8000 npm start
