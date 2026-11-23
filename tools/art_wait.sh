#!/bin/zsh
# 等到 <id> 的指定 raw 圖都生好（或 30 分鐘）：tools/art_wait.sh jie [atk_down atk_side atk_up]
cd ${0:A:h}/..
id=$1; shift; sheets=(${@:-atk_down atk_side atk_up})
for i in {1..360}; do
  ok=1; for s in $sheets; do [ -s design/art/raw/${id}_$s.png ] || ok=0; done
  [ $ok = 1 ] && { echo "ready $id $sheets"; exit 0; }
  sleep 5
done; echo "timeout $id"
