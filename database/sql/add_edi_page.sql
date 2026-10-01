-- Add the EDI page and grant it only to user_id 1's current privilege.
-- Run this script against the application database.

START TRANSACTION;

INSERT INTO fjp_pages (page, page_name, page_icon, arrange_no)
SELECT
    'edi',
    'EDI',
    'edi',
    COALESCE(
        (SELECT arrange_no + 1 FROM fjp_pages WHERE page = 'clients' LIMIT 1),
        (SELECT COALESCE(MAX(arrange_no), 0) + 1 FROM fjp_pages)
    )
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM fjp_pages WHERE page = 'edi'
);

SET @edi_page_id = (SELECT p_id FROM fjp_pages WHERE page = 'edi' LIMIT 1);
SET @admin_privilege = (SELECT priv_id FROM fjp_users WHERE user_id = 1 LIMIT 1);

INSERT INTO fjp_pages_access (page_id, privilege, acs_edit, acs_delete)
SELECT @edi_page_id, @admin_privilege, 0, 0
FROM DUAL
WHERE @edi_page_id IS NOT NULL
  AND @admin_privilege IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM fjp_pages_access
      WHERE page_id = @edi_page_id
        AND privilege = @admin_privilege
  );

COMMIT;
