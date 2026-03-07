export class Money {
  private constructor(private readonly cents: number) {}

  static fromAmount(amount: number) {
    return new Money(Math.round(amount * 100));
  }

  toAmount() {
    return this.cents / 100;
  }
}
