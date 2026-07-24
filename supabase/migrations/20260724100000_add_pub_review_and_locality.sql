-- Store the Google review destination and locality used for each Lapen Inns pub.
-- Email is used only as the stable selector; no merchant identity/contact fields
-- are changed by this migration.
alter table public.merchants
  add column pub_google_review text,
  add column locals text;

update public.merchants as merchants
set
  pub_google_review = pub_details.pub_google_review,
  locals = pub_details.locals
from (
  values
    (
      'thequeen@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJ-66av5mL10cR9uBJXjaUD4w',
      'King''s Lynn'
    ),
    (
      'oldcrown@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4',
      'Girton'
    ),
    (
      'whitehorse@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJu0gLOv1x2EcRZFvk-xeLeYw',
      'Waterbeach'
    ),
    (
      'cornerhouse@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJJ_hEYYpw2EcRDo5BWTjmvpM',
      'East Cambridge'
    ),
    (
      'theprince@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJiRlOeKuxd0gRyQ2WIIL1GnI',
      'Bromham'
    ),
    (
      'thebell@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJB1vNNdTpd0gR7lHyakFy_f8',
      'Sawtry'
    ),
    (
      'therailway@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJn09BgED7d0gRjUmOuzWq6wI',
      'Whittlesey'
    ),
    (
      'barleymow@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJb2pwmRLdd0gRMWzw4D30wQ4',
      'Hartford'
    ),
    (
      'oldschoolhouse@lapeninns.com',
      'https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664',
      'Stony Stratford'
    )
) as pub_details(email, pub_google_review, locals)
where lower(merchants.email) = pub_details.email;
