/* Copyright (c) 2020 vesoft inc. All rights reserved.
 *
 * This source code is licensed under Apache 2.0 License,
 * attached with Common Clause Condition 1.0, found in the LICENSES directory.
 */

#ifndef GRAPH_EXECUTOR_ADMIN_SHOW_TS_CLIENTS_EXECUTOR_H_
#define GRAPH_EXECUTOR_ADMIN_SHOW_TS_CLIENTS_EXECUTOR_H_

#include "graph/executor/Executor.h"

namespace nebula {
namespace graph {

class ShowTSClientsExecutor final : public Executor {
 public:
  ShowTSClientsExecutor(const PlanNode *node, QueryContext *qctx)
      : Executor("ShowTSClientsExecutor", node, qctx) {}

  folly::Future<Status> execute() override;

 private:
  folly::Future<Status> showTSClients();
};

}  // namespace graph
}  // namespace nebula

#endif  // GRAPH_EXECUTOR_ADMIN_SHOW_TS_CLIENTS_EXECUTOR_H_
