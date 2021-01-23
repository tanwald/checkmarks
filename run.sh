#!/usr/bin/env bash

if [ "$1" = "build" ]; then
    web-ext lint && web-ext build --overwrite-dest --ignore-files=run.sh --ignore-files=Checkmarks.iml
else
    if [ "$1" = "dark" ]; then
        gsettings set org.gnome.desktop.interface gtk-theme 'Adwaita-dark'
    elif [ "$1" = "light" ]; then
        gsettings set org.gnome.desktop.interface gtk-theme 'Adwaita'
    fi
    web-ext run --reload --url 'about:debugging#/runtime/this-firefox'
fi