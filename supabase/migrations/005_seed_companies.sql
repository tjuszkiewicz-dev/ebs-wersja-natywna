-- =============================================================================
-- EBS — Migracja 005: Seed firm demonstracyjnych
-- =============================================================================
-- Wstawia dwie firmy z deterministycznymi UUID pasującymi do danych mock
-- w services/mockData.ts. Bezpieczne do wielokrotnego uruchomienia (ON CONFLICT DO NOTHING).

INSERT INTO companies (id, name, nip, address_street, address_city, address_zip,
                       balance_pending, balance_active, origin)
VALUES
  (
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    'Stratton Prime S.A.',
    '52100000001',
    'ul. Marszałkowska 1',
    'Warszawa',
    '00-001',
    0,
    1000,
    'NATIVE'
  ),
  (
    'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    'TechSolutions Sp. z o.o.',
    '52500011122',
    'ul. Krakowska 42',
    'Kraków',
    '30-001',
    0,
    500,
    'NATIVE'
  )
ON CONFLICT (id) DO NOTHING;
