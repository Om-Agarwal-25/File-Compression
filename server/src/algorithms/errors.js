export class CorruptDataError extends Error {
  constructor(message) {
    super(message);
    this.name = "CorruptDataError";
  }
}
