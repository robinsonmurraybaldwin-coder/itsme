// Supabase 설정
// Project Settings → Data API 의 URL 과 API Keys 의 anon(public) 키입니다.
// 둘 다 브라우저에 공개되어도 되는 값이고, 데이터 보호는 RLS(supabase/schema.sql)가 담당합니다.
// 비워두면 브라우저 localStorage 에 저장되는 "로컬 모드"로 동작합니다.
// ⚠️ service_role / secret 키는 절대 여기에 넣지 마세요.
export const SUPABASE_URL = "https://lhguyfmqvsvwychtcoeh.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZ3V5Zm1xdnN2d3ljaHRjb2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MjgwNzcsImV4cCI6MjExMDIwNDA3N30.1C_1DZi2c-v2uLrAfubSBX1oMRWG_2lbpiv8Q1n5W84";
