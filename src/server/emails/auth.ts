// Tekstovi mailova za nalog. Obični tekst: stiže svuda, ne završava u "promocijama".
import { APP_NAME } from "@/lib/brand";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function resetPasswordEmail(name: string, url: string) {
  return {
    subject: `Nova lozinka za ${APP_NAME}`,
    text: [
      `Zdravo ${firstName(name)},`,
      "",
      "Zatražena je nova lozinka za vaš nalog. Postavite je preko ovog linka (važi 1 sat):",
      url,
      "",
      "Ako niste vi tražili promjenu, samo zanemarite ovaj mail — lozinka ostaje ista.",
      "",
      APP_NAME,
    ].join("\n"),
  };
}

export function verifyEmailEmail(name: string, url: string) {
  return {
    subject: `Potvrdite email za ${APP_NAME}`,
    text: [
      `Zdravo ${firstName(name)},`,
      "",
      "Potvrdite da je ovo vaša adresa — na nju vam stižu obavijesti i link za novu lozinku ako je zaboravite:",
      url,
      "",
      "Ako niste otvarali nalog, zanemarite ovaj mail.",
      "",
      APP_NAME,
    ].join("\n"),
  };
}
