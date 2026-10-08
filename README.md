# Sightline 視譜練習

一個使用原生 HTML/CSS/JavaScript 與 Python 標準庫建立的視譜練習 MVP。

## 啟動

```bash
python3 app.py
```

開啟 <http://127.0.0.1:8000>。第一次啟動會在專案根目錄建立 `practice.db`，它已被設計為本機資料檔，不應提交到版本控制。

## GitHub Pages（簡易無記憶版）

`docs/index.html` 是不需要 Python 後端的手機版練習頁，不使用 cookie、localStorage 或資料庫；重新整理頁面後題目與本輪分數會重置。

推送到 GitHub 後，在 repository 的 **Settings → Pages** 選擇 **Deploy from a branch**、`main`、`/docs`，即可透過以下網址開啟：

`https://marsnow.github.io/violin-learner/`

若要在本機預覽 GitHub Pages 版本：

```bash
python3 -m http.server 8080 --directory docs
```

然後開啟 <http://127.0.0.1:8080>。原本的 `python3 app.py` 仍是包含 SQLite 答題紀錄與學習報表的本機版本。

## 功能

- 高音譜號 G3–E6 隨機出題，涵蓋一至三把位的自然音，共 20 個音。
- 關卡包含第一至第七把位、一至三把位複習、四至六把位複習，以及第七把位後的總複習。
- 每個關卡 20 題，關卡可以自由選擇進入，不需要依序解鎖。
- 每題必須同時選擇 A–G 與 Do–Si；後端會重新判定兩組答案。
- SQLite 儲存每次答題、兩組答案是否正確，以及是否全對。
- 報表顯示總正確率、兩組答案正確數與常錯音符。
- 錯誤越多的音符，下一次被抽到的權重越高。

## 測試

```bash
python3 -m unittest -v
```
