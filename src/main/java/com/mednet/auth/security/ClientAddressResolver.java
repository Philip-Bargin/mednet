package com.mednet.auth.security;

import java.util.List;

import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import jakarta.servlet.http.HttpServletRequest;

/**
 * The client address used for rate limiting. {@code server.forward-headers-strategy: framework}
 * rewrites {@code getRemoteAddr()} from any caller's {@code X-Forwarded-For}, so this reads the
 * container's own request (the TCP peer) and honours forwarding headers only from configured proxies.
 */
@Component
public class ClientAddressResolver {

    private final List<IpAddressMatcher> trustedProxies;

    public ClientAddressResolver(AuthRateLimitProperties properties) {
        this.trustedProxies = properties.getTrustedProxies().stream()
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(IpAddressMatcher::new)
                .toList();
    }

    public String resolve(HttpServletRequest request) {
        ServletRequest original = request;
        while (original instanceof ServletRequestWrapper wrapper) {
            original = wrapper.getRequest();
        }
        String peer = original.getRemoteAddr();
        if (!isTrustedProxy(peer) || !(original instanceof HttpServletRequest http)) {
            return peer;
        }
        String forwardedFor = http.getHeader("X-Forwarded-For");
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return peer;
        }
        // Each trusted proxy appends the address it received from, so read from the right and stop at
        // the first hop that is not one of ours; everything left of it is client-supplied.
        String[] hops = forwardedFor.split(",");
        for (int index = hops.length - 1; index >= 0; index--) {
            String hop = hops[index].trim();
            if (!isIpAddress(hop)) {
                return peer;
            }
            if (!isTrustedProxy(hop)) {
                return hop;
            }
        }
        return peer;
    }

    private boolean isTrustedProxy(String address) {
        if (address == null || !isIpAddress(address)) {
            return false;
        }
        try {
            return trustedProxies.stream().anyMatch(matcher -> matcher.matches(address));
        } catch (IllegalArgumentException invalidAddress) {
            return false;
        }
    }

    /** A literal IPv4 or IPv6 address; never resolves host names. */
    private static boolean isIpAddress(String value) {
        if (value.isEmpty() || value.length() > 45) {
            return false;
        }
        if (value.matches("\\d{1,3}(\\.\\d{1,3}){3}")) {
            for (String part : value.split("\\.")) {
                if (Integer.parseInt(part) > 255) {
                    return false;
                }
            }
            return true;
        }
        return value.contains(":") && value.matches("[0-9A-Fa-f:.]+");
    }
}
