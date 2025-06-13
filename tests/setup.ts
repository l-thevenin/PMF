import { execSync } from 'child_process';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { randomBytes } from 'crypto';

let container: StartedTestContainer;

beforeAll(async () => {
  // Créer un conteneur PostgreSQL temporaire pour les tests
  const dbName = `test_${randomBytes(4).toString('hex')}`;
  container = await new GenericContainer('postgres')
    .withEnvironment({
      POSTGRES_USER: 'trading',
      POSTGRES_PASSWORD: 'tradingpass',
      POSTGRES_DB: dbName
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  // Configurer l'URL de la base de données pour les tests
  const port = container.getMappedPort(5432);
  process.env.DATABASE_URL = `postgresql://trading:tradingpass@localhost:${port}/${dbName}`;

  // Exécuter les migrations Prisma
  execSync('npx prisma generate');
  execSync('npx prisma db push --accept-data-loss');
});

afterAll(async () => {
  if (container) {
    await container.stop();
  }
});
