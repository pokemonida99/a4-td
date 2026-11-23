#!/bin/zsh
# 排隊生圖、最多兩張同時（P=3 可改）：tools/art_queue.sh jie:atk_side kevin:atk_down …（已存在的 raw 圖會跳過）
cd ${0:A:h}/..
for job in $@; do
  id=${job%%:*}; sh=${job#*:}
  [ -s design/art/raw/${id}_${sh}.png ] && { echo "skip $job" >&2; continue; }
  echo "$id $sh"
done | xargs -P ${P:-2} -n 2 tools/art_gen.sh
