export abstract class ValueObject<T> {
  protected constructor(readonly value: T) {}

  equals(other: ValueObject<T>) {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}
