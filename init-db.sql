-- Création de la base de données si elle n'existe pas
SELECT 'CREATE DATABASE tradingbot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tradingbot')\gexec

-- Connexion à la base de données
\c tradingbot;

-- S'assurer que l'utilisateur a tous les droits nécessaires
GRANT ALL PRIVILEGES ON DATABASE tradingbot TO trading;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trading;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trading;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO trading;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO trading;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO trading;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO trading;
