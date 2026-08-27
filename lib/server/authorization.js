export function httpStatusFor(decision) {
    if (decision.effect === 'allow')
        return null;
    if (decision.reason === 'missing_token') {
        return { status: 401, body: 'unauthorized' };
    }
    return { status: 403, body: 'forbidden' };
}
const LOGGABLE = new Set([
    'expired',
    'invalid_signature',
    'issuer_mismatch',
    'audience_mismatch',
    'missing_token',
    'jwks_unavailable',
    'unconfigured',
    'malformed',
    'host_origin_rejected',
]);
export function logReason(reason) {
    if (reason !== null && LOGGABLE.has(reason))
        return reason;
    return 'malformed';
}
export function logBoot(logger, input) {
    logger.info('plugin initialized');
    if (input.configured && input.issuer !== null) {
        logger.info(`Cloudflare issuer configured (${input.issuer})`);
    }
    else {
        logger.warn('Cloudflare Access is not configured; remote privileged APIs will be denied');
    }
    logger.info(`audience count ${String(input.audienceCount)}`);
    logger.info(`ordinary auth mode ${input.ordinary}`);
}
export function logDenied(logger, input) {
    const method = input.method ?? '(unknown)';
    const reason = logReason(input.reason);
    if (input.privileged) {
        logger.warn(`privileged request denied method=${method} reason=${reason}`);
        return;
    }
    logger.warn(`request denied method=${method} reason=${reason}`);
}
//# sourceMappingURL=authorization.js.map