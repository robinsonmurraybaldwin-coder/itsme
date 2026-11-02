# itsme

## P&L 영상 수정 (Vantage 웹 화면 녹화)

Vantage 웹 트레이딩 화면 녹화본의 **손익(P&L)을 원하는 금액대로 자연스럽게 바꾸는** 작업을
여기서 반복한다. 재사용 툴킷·노하우는 **`tools/pnl_edit/`** 에 있다.

- 파이프라인: `tools/pnl_edit/pnl_edit.py` (`python3 pnl_edit.py 소스.mp4 결과.mp4 --lo 9994 --hi 10355`)
- 방법·교훈: `tools/pnl_edit/README.md` **(새 영상 작업 전 반드시 먼저 읽기)**

핵심만: Inter 폰트 / 차트 숫자는 가로압축 / muted green 반투명 / 알약 반투명 배경 유지(불투명 박스 금지) /
inpaint는 숫자 슬롯만 / 움직임은 원본의 실제 변동 타이밍을 프레임차분으로 재현(틱=13.88 배수).
**픽셀 좌표(CFG)는 영상마다 다시 측정** — 해상도/줌/스크롤 바뀌면 안 맞음.
