/* Copyright (c) 2021 vesoft inc. All rights reserved.
 *
 * This source code is licensed under Apache 2.0 License,
 * attached with Common Clause Condition 1.0, found in the LICENSES directory.
 */

#pragma once

#include <folly/TokenBucket.h>

#include "common/base/Base.h"
#include "common/thrift/ThriftTypes.h"
#include "common/time/WallClock.h"

DECLARE_bool(skip_wait_in_rate_limiter);

namespace nebula {
namespace kvstore {

// A simple wrapper for foly::TokenBucket, it would limit the speed to rate_ * buckets_.size().
// For now, there are two major cases: snapshot (both for balance or catch up) and rebuild index.
class RateLimiter {
 public:
  RateLimiter(int32_t rate, int32_t burstSize)
      : rate_(static_cast<double>(rate)), burstSize_(static_cast<double>(burstSize)) {
    // token will be available after 1 second, to prevent speed spike at the beginning
    auto now = time::WallClock::fastNowInSec();
    int64_t waitInSec = FLAGS_skip_wait_in_rate_limiter ? 0 : 1;
    bucket_.reset(new folly::TokenBucket(rate_, burstSize_, static_cast<double>(now + waitInSec)));
  }

  // Caller must make sure the **the parition has been add, and won't be removed during consume.**
  // Snaphot and rebuild index follow this principle by design.
  void consume(size_t toConsume) {
    if (toConsume > burstSize_) {
      // consumeWithBorrowAndWait do nothing when toConsume > burstSize_, we sleep 1s instead
      std::this_thread::sleep_for(std::chrono::seconds(1));
    } else {
      // If there are enouth tokens, consume and return immediately.
      // If not, cosume anyway, but sleep enough time before return.
      auto now = time::WallClock::fastNowInSec();
      bucket_->consumeWithBorrowAndWait(static_cast<double>(toConsume), static_cast<double>(now));
    }
  }

 private:
  std::unique_ptr<folly::TokenBucket> bucket_;
  double rate_{1 << 20};
  double burstSize_{1 << 20};
};

}  // namespace kvstore
}  // namespace nebula
