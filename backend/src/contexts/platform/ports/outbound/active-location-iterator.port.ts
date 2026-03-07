export const ACTIVE_LOCATION_ITERATOR_PORT = Symbol('ACTIVE_LOCATION_ITERATOR_PORT');

export type ActiveLocationContext = {
  brandId: string;
  localId: string;
};

export interface ActiveLocationIteratorPort {
  forEachActiveLocation(
    callback: (context: ActiveLocationContext) => Promise<void>,
  ): Promise<void>;
}
