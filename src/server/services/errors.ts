export class AdminResourceNotFoundError extends Error {
  constructor() {
    super("The requested record was not found.");
    this.name = "AdminResourceNotFoundError";
  }
}
