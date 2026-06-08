import { getDocumentDefinition } from "./documents";
import type { CalculatedDates, StoredDocument } from "./types";

const DATE_FORMATTER = new Intl.DateTimeFormat("da-DK", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export const formatDate = (isoDate?: string) => {
  if (!isoDate) return "Ikke angivet";
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Ugyldig dato" : DATE_FORMATTER.format(date);
};

export const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const addMonths = (isoDate: string, months: number) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return toInputDate(date);
};

const addYears = (isoDate: string, years: number) => addMonths(isoDate, years * 12);

export const calculateDates = (document: StoredDocument): CalculatedDates => {
  const definition = getDocumentDefinition(document.id);
  if (!definition || !document.validFrom) {
    return { status: "empty", statusText: "Mangler gyldighedsdato" };
  }

  const expiresOn =
    definition.kind === "driver"
      ? addMonths(document.validFrom, document.validityMonths || 60)
      : addYears(document.validFrom, document.validityYears || 5);

  const orderBy =
    definition.kind === "driver" ? addMonths(expiresOn, -3) : addMonths(expiresOn, -2);

  const today = toInputDate(new Date());
  const warningStart =
    definition.kind === "driver" ? addMonths(orderBy, -1) : addMonths(orderBy, -1);

  if (expiresOn < today) {
    return { expiresOn, orderBy, status: "red", statusText: "Udløbet" };
  }

  if (today >= warningStart) {
    return { expiresOn, orderBy, status: "yellow", statusText: "Nærmer sig" };
  }

  return { expiresOn, orderBy, status: "green", statusText: "God tid" };
};

export const createGoogleCalendarUrl = (
  title: string,
  date: string,
  description: string
) => {
  const compactDate = date.replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${compactDate}/${compactDate}`,
    details: description
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
