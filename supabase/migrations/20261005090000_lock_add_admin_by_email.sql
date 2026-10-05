-- add_admin_by_email körs med ägarrättigheter och var körbar för alla,
-- även utloggade, vilket lät vem som helst göra valfri användare till admin.
-- Appen anropar den inte; bara servern (service_role) får använda den.
revoke execute on function public.add_admin_by_email(text) from public, anon, authenticated;
