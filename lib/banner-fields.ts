export const requiredBannerFields = [
  "StudentID",
  "FirstName",
  "LastName",
  "Email",
  "Program",
  "Campus",
  "AdmissionStatus",
  "TemplateType"
] as const;

export const bannerFields = [
  "StudentID",
  "Term",
  "FirstName",
  "MiddleName",
  "LastName",
  "AddressCode",
  "Address1",
  "Address2",
  "Address3",
  "City",
  "Country",
  "Nation",
  "Campus",
  "College",
  "Degree",
  "Major",
  "Status",
  "Program",
  "DateGenerated",
  "BirthDate",
  "IDPassport",
  "ResidencyCode",
  "ResidencyDescription",
  "ApplicationSource",
  "SpridenUser",
  "Email",
  "EmailCode",
  "Phone1",
  "Phone2",
  "AdmissionStatus",
  "EmailStatus",
  "SentDate",
  "WordFileName",
  "PDFFileName",
  "ErrorMessage",
  "ProcessedByFlow",
  "TemplateType"
] as const;

export type BannerField = (typeof bannerFields)[number];

export const derivedLetterFields = [
  "FullName",
  "Today"
] as const;

export const mappableLetterFields = [
  ...bannerFields,
  ...derivedLetterFields
] as const;

export type MappableLetterField = (typeof mappableLetterFields)[number];

export const bannerToDbField: Record<BannerField, string> = {
  StudentID: "student_id",
  Term: "term",
  FirstName: "first_name",
  MiddleName: "middle_name",
  LastName: "last_name",
  AddressCode: "address_code",
  Address1: "address1",
  Address2: "address2",
  Address3: "address3",
  City: "city",
  Country: "country",
  Nation: "nation",
  Campus: "campus",
  College: "college",
  Degree: "degree",
  Major: "major",
  Status: "status",
  Program: "program",
  DateGenerated: "date_generated",
  BirthDate: "birth_date",
  IDPassport: "id_passport",
  ResidencyCode: "residency_code",
  ResidencyDescription: "residency_description",
  ApplicationSource: "application_source",
  SpridenUser: "spriden_user",
  Email: "email",
  EmailCode: "email_code",
  Phone1: "phone1",
  Phone2: "phone2",
  AdmissionStatus: "admission_status",
  EmailStatus: "email_status",
  SentDate: "sent_date",
  WordFileName: "word_file_name",
  PDFFileName: "pdf_file_name",
  ErrorMessage: "error_message",
  ProcessedByFlow: "processed_by_flow",
  TemplateType: "template_type"
};
