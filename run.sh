#!/usr/bin/env bash

if [ "$1" = "build" ]; then
    web-ext lint && web-ext build --overwrite-dest --ignore-files=run.sh
else
    web-ext run --reload --url 'about:debugging#/runtime/this-firefox'
fi