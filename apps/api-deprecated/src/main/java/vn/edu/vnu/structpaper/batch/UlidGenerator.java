package vn.edu.vnu.structpaper.batch;

import java.security.SecureRandom;

public final class UlidGenerator {

    private static final char[] ENCODING_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private UlidGenerator() {}

    /**
     * Generates a 26-character Crockford Base32 ULID conforming to OpenAPI regex:
     * ^[0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz]{26}$
     */
    public static String nextUlid() {
        long timestamp = System.currentTimeMillis();
        char[] chars = new char[26];

        // 10 characters of time component (48-bit timestamp)
        for (int i = 9; i >= 0; i--) {
            chars[i] = ENCODING_CHARS[(int) (timestamp & 0x1F)];
            timestamp >>>= 5;
        }

        // 16 characters of randomness (80-bit entropy)
        for (int i = 10; i < 26; i++) {
            chars[i] = ENCODING_CHARS[RANDOM.nextInt(32)];
        }

        return new String(chars);
    }
}
