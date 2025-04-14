#!/bin/bash
for i in {1..10000}
do
  pytest ./test_draw.py >> ./result.txt
  echo "  " >> ./result.txt
  echo "  " >> ./result.txt
  echo "  " >> ./result.txt
done