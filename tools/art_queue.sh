#!/bin/zsh
# 排隊生圖：tools/art_queue.sh jie:atk_side kevin:atk_down …（已有的 raw 圖跳過；P=3 全機同時張數）
# 依序送出；需要參考圖的（atk 要 idle、斜向出手要 idle_diag、敵人側背面要 walk_down）會等參考圖生好才送。
# 每張開始／結束都記在 design/art/raw/queue.log
# 注意：在 zsh 組工作清單要寫 ${c}:atk_down，不能寫 $c:atk_down（:a 會被當成路徑修飾字）
cd ${0:A:h}/..
P=${P:-3}; LOG=design/art/raw/queue.log; R=design/art/raw
dep() { case $2 in atk_dside|atk_uside) echo $R/$1_idle_diag.png ;; atk_*|idle_diag) echo $R/$1_idle.png ;; walk_side|walk_up|extra) echo $R/$1_walk_down.png ;; esac }
running() { pgrep -f "gen.sh design/art/raw" | wc -l }
for job in $@; do
  id=${job%%:*}; sh=${job#*:}
  [ -s $R/${id}_${sh}.png ] && { echo "$(date +%T) skip $job" >> $LOG; continue; }
  d=$(dep $id $sh)
  if [ -n "$d" ]; then for i in {1..240}; do [ -s $d ] && break; sleep 5; done; fi
  while (( $(running) >= P )); do sleep 3; done
  echo "$(date +%T) start $job" >> $LOG
  ( tools/art_gen.sh $id $sh >> $LOG 2>&1; echo "$(date +%T) end $job $([ -s $R/${id}_${sh}.png ] && echo ok || echo MISSING)" >> $LOG ) &
  sleep 4      # 讓 gen.sh 先起來，下一輪 running() 才算得到
done
wait
