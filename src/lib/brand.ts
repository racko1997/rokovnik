/** Radni naziv proizvoda — mijenja se samo ovdje. */
export const APP_NAME = "Rokovnik";

/**
 * Ko stoji iza usluge (pravne stranice, kontakt). Popunjava se kad postoji domena
 * i odluka o firmi; dok je prazno, stranice upućuju na formu na naslovnoj.
 */
export const OPERATOR = {
  /** npr. "Ime Prezime, preduzetnik" ili "Naziv d.o.o., adresa" */
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "",
  /** npr. "kontakt@rokovnik.ba" */
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};
