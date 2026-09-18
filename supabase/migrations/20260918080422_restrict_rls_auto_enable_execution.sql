-- `rls_auto_enable`은 ETF 애플리케이션의 공개 API가 아니다.
-- SECURITY DEFINER 함수가 anon/authenticated/PUBLIC에 노출되는 것을 차단한다.
revoke execute on function public.rls_auto_enable()
  from anon, authenticated, public;
