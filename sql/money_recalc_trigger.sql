-- Пересчёт годовых колонок clinic_private из помесячных sales_monthly.
-- Вставить целиком в Supabase → SQL Editor → Run. Один раз.
-- Логика: при любой записи/правке/удалении строки продажи пересчитывается
-- колонка sales_ГОД (Boston) или hugemed_ГОД (HugeMed) у этой клиники.
-- Защита: если сумма по месяцу равна нулю, старая колонка НЕ обнуляется —
-- иначе пропали бы клиники, которые ведутся только годовой суммой.

create or replace function public.recalc_clinic_money(p_clinic int, p_year int)
returns void language plpgsql as $$
declare v_col text; v_sum numeric;
begin
  if p_clinic is null or p_year is null or p_year < 2016 then return; end if;

  -- Boston
  v_col := 'sales_' || p_year;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='clinic_private' and column_name=v_col) then
    select coalesce(sum(sale),0) into v_sum
      from public.sales_monthly
     where clinic_id = p_clinic and year = p_year
       and lower(coalesce(product,'')) <> 'hugemed';
    if v_sum > 0 then
      execute format('update public.clinic_private set %I = $1 where clinic_id = $2 and coalesce(%I,0) <> $1', v_col, v_col)
        using v_sum, p_clinic;
    end if;
  end if;

  -- HugeMed
  v_col := 'hugemed_' || p_year;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='clinic_private' and column_name=v_col) then
    select coalesce(sum(sale),0) into v_sum
      from public.sales_monthly
     where clinic_id = p_clinic and year = p_year
       and lower(coalesce(product,'')) = 'hugemed';
    if v_sum > 0 then
      execute format('update public.clinic_private set %I = $1 where clinic_id = $2 and coalesce(%I,0) <> $1', v_col, v_col)
        using v_sum, p_clinic;
    end if;
  end if;
end $$;

create or replace function public.trg_sales_monthly_money()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recalc_clinic_money(new.clinic_id, new.year);
  end if;
  if tg_op in ('DELETE','UPDATE') and old.clinic_id is not null then
    if tg_op = 'DELETE' or old.clinic_id <> new.clinic_id or old.year <> new.year then
      perform public.recalc_clinic_money(old.clinic_id, old.year);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists sales_monthly_money on public.sales_monthly;
create trigger sales_monthly_money
after insert or update or delete on public.sales_monthly
for each row execute function public.trg_sales_monthly_money();

-- Разовая сверка всех лет сразу (можно выполнить тем же запуском):
select public.recalc_clinic_money(clinic_id, year)
from (select distinct clinic_id, year from public.sales_monthly) t;
