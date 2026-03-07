const emitSummary = () => {
  console.log(
    '[migration:smoke:summary] ' +
      JSON.stringify({
        smokeId: 'runtime-parity',
        check: 'runtime-parity',
        status: 'SKIP',
        reason: 'legacy_mode_removed',
      }),
  );
};

const main = async () => {
  console.log('Runtime parity smoke skipped: booking legacy mode is retired (PR35-D).');
  emitSummary();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
