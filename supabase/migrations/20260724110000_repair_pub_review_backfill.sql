-- Repair the pub review backfill for venues whose Nabaperks account email is
-- different from the operator-supplied pub contact email. The customer card
-- reads these fields from merchants, so match both contact email and canonical
-- venue name without changing merchant identity or contact details.
with pub_details(email, business_names, pub_google_review, locals) as (
  values
    (
      'thequeen@lapeninns.com',
      array['the queen elizabeth']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJ-66av5mL10cR9uBJXjaUD4w',
      'King''s Lynn'
    ),
    (
      'oldcrown@lapeninns.com',
      array['the old crown', 'old crown girton']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4',
      'Girton'
    ),
    (
      'whitehorse@lapeninns.com',
      array['the white horse', 'white horse']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJu0gLOv1x2EcRZFvk-xeLeYw',
      'Waterbeach'
    ),
    (
      'cornerhouse@lapeninns.com',
      array['the corner house']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJJ_hEYYpw2EcRDo5BWTjmvpM',
      'East Cambridge'
    ),
    (
      'theprince@lapeninns.com',
      array['the prince of wales']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJiRlOeKuxd0gRyQ2WIIL1GnI',
      'Bromham'
    ),
    (
      'thebell@lapeninns.com',
      array['the bell']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJB1vNNdTpd0gR7lHyakFy_f8',
      'Sawtry'
    ),
    (
      'therailway@lapeninns.com',
      array['the railway']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJn09BgED7d0gRjUmOuzWq6wI',
      'Whittlesey'
    ),
    (
      'barleymow@lapeninns.com',
      array['the barley mow']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJb2pwmRLdd0gRMWzw4D30wQ4',
      'Hartford'
    ),
    (
      'oldschoolhouse@lapeninns.com',
      array['the old school house']::text[],
      'https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664',
      'Stony Stratford'
    )
),
matched_pub_details as (
  select distinct on (merchants.id)
    merchants.id as merchant_id,
    pub_details.pub_google_review,
    pub_details.locals
  from public.merchants as merchants
  join pub_details
    on lower(btrim(merchants.email)) = pub_details.email
    or lower(btrim(merchants.business_name)) = any(pub_details.business_names)
  order by
    merchants.id,
    (lower(btrim(merchants.email)) = pub_details.email) desc,
    pub_details.email
)
update public.merchants as merchants
set
  pub_google_review = matched_pub_details.pub_google_review,
  locals = matched_pub_details.locals
from matched_pub_details
where
  merchants.id = matched_pub_details.merchant_id
  and (
    merchants.pub_google_review is distinct from matched_pub_details.pub_google_review
    or merchants.locals is distinct from matched_pub_details.locals
  );
