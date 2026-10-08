/**
 * Demo podaci za lokalni razvoj: salon, radnici, usluge i termini za ovu sedmicu.
 *
 *   npm run db:seed
 *
 * Test nalog (samo lokalno):  demo@rokovnik.test / demo12345
 * Skripta briše i ponovo pravi demo salon, ostale podatke ne dira.
 * U produkciji se demo salon obnavlja dugmetom na /admin/prijave (bez poznate lozinke).
 */
import "dotenv/config";
import { DEMO_EMAIL, resetDemoSalon } from "../src/server/services/demo";

const DEMO_PASSWORD = "demo12345";

resetDemoSalon({ ownerPassword: DEMO_PASSWORD })
  .then(({ slug }) => {
    console.log(`Demo salon: /s/${slug}`);
    console.log(`Prijava: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
