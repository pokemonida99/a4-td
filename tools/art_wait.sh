#!/bin/zsh
# 等到 <id> 的三張 atk 都生好（或 25 分鐘）就結束：tools/art_wait.sh jie
cd ${0:A:h}/..
for i in {1..300}; do
  [ -s design/art/raw/$1_atk_down.png ] && [ -s design/art/raw/$1_atk_side.png ] && [ -s design/art/raw/$1_atk_up.png ] && { echo "ready $1"; exit 0; }
  sleep 5
done; echo "timeout $1"
