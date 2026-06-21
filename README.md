# HY-WAY

**한양대의 가장 빠른 길** — 한양대학교 서울캠퍼스 전용 길찾기 서비스입니다.

## 주요 기능

- Kakao Maps 기반 캠퍼스 지도와 nodes/edges 그래프 길찾기
- 일반 경로와 포탈 포함 경로 비교
- 오르막·계단·엘리베이터·포탈 이동 반영
- 건물 기반 장소 커뮤니티 및 경로 데이터 제보
- Supabase 기반 게시글·댓글·좋아요·제보 저장 준비

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev
```

`.env`에 다음 값을 설정합니다.

```env
VITE_KAKAO_MAP_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase_schema.sql`을 실행합니다.
3. 프로젝트 URL과 anon/publishable key를 `.env`에 넣습니다.

현재 스키마는 발표용 MVP의 익명 read/insert 정책입니다. 운영 단계에서는 반드시 Auth 기반 RLS 정책으로 강화해야 합니다. `service_role` 키는 브라우저 또는 GitHub에 절대 넣지 마세요.

## Kakao Maps 설정

카카오 개발자 콘솔에서 JavaScript 키를 발급하고, 로컬 주소와 배포된 Vercel 도메인을 Web 플랫폼에 등록해야 합니다.

## Vercel 배포

1. GitHub 저장소에 push합니다.
2. Vercel에서 **Add New Project** → 저장소 import를 선택합니다.
3. Framework Preset은 **Vite**를 선택합니다.
4. `VITE_KAKAO_MAP_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다.
5. Deploy 후 Vercel 도메인을 카카오 Web 플랫폼에 추가합니다.

## Deploy Checklist

- [ ] Vercel URL에서 앱 접속 가능
- [ ] Kakao Map 정상 표시
- [ ] 일반/포탈 경로 비교 가능
- [ ] 커뮤니티 글·댓글·좋아요 저장
- [ ] 제보 저장 및 Supabase Table Editor 확인
- [ ] 다른 기기에서 커뮤니티 데이터 확인
