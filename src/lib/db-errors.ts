// Turns database errors into messages school staff can act on, without
// exposing SQL, constraint internals or other users' data. Log the original
// error server-side.

export interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
}

export type FieldErrors = Record<string, string>;

// Unique indexes that map to a specific form field.
const uniqueFieldMessages: { match: string; field: string; message: string }[] = [
  {
    match: "students_unique_admission_no",
    field: "admission_no",
    message: "Another student already has this admission number.",
  },
  {
    match: "students_unique_active_roll_no",
    field: "roll_no",
    message: "Another active student in this section has this roll number.",
  },
  {
    match: "teacher_assignments_teacher_id_section_id_academic_year_id_key",
    field: "section_id",
    message: "This teacher is already assigned to that section.",
  },
];

export function describeDbError(error: DbErrorLike): { message: string; fieldErrors?: FieldErrors } {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  switch (error.code) {
    case "23505": {
      const known = uniqueFieldMessages.find((u) => text.includes(u.match));
      if (known) return { message: known.message, fieldErrors: { [known.field]: known.message } };
      return { message: "This record already exists." };
    }
    case "23503":
      return { message: "The selected class or section is not valid. Please choose again." };
    case "23514":
    case "22P02":
    case "22023":
      return { message: "Some details are not valid. Please check the form." };
    case "42501":
      return { message: "You do not have permission to do this." };
    case "PGRST116":
    case "P0002":
      return { message: "That record could not be found." };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}
