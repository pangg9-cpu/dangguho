# 댕구호

성현 & 지윤의 가족 공유 앱 (캘린더 / 일기 / 다녀온 곳 / 장보기 / 재고)

## 배포 방법 (GitHub → Vercel)

1. github.com 에서 새 저장소(repository) 생성 (이름: dangguho, Public 또는 Private 아무거나)
2. 이 폴더 전체를 그 저장소에 업로드
   - GitHub 웹사이트에서 "Add file → Upload files" 로 폴더 안 파일들을 드래그해서 올려도 됨
3. vercel.com 접속 → GitHub 계정으로 로그인
4. "Add New... → Project" → 방금 만든 dangguho 저장소 선택 → Deploy 클릭
5. 몇 분 후 `dangguho-xxxx.vercel.app` 같은 주소가 생성됨
6. 그 주소를 폰으로 열어서 홈 화면에 추가하면 완성

## 로컬에서 테스트하고 싶다면

```
npm install
npm run dev
```
