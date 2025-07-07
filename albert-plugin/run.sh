#!/usr/bin/env bash

rm -rf build/ && mkdir build && cd build && cmake .. && make && sudo cp AlberFlowy.so /usr/lib/x86_64-linux-gnu/albert/AlberFlowy.so && echo "Moved AlberFlowy.so to /usr/lib/x86_64-linux-gnu/albert/"
