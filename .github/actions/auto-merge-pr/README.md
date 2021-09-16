# Auto Merge Pr Bot
Github Action for merging pull request that are approved by reviewers and maintainer, and send merge info to dingding group.

# Example Usage
```
    - name: Run merge script
      uses: klay-ke/auto-merge-pr@master
      id: merge-pr
      with:
        send-to-dingtalk-group: true
        dingtalk-access-token: ${{ secrets.DINGTALK_ACCESS_TOKEN }}
        dingtalk-secret: ${{ secrets.DINGTALK_SECRET }}
        maintainer-team-name: ${{ secrets.MAINTAINER_TEAM_NAME }}
        gh-token: ${{ secrets.GH_TOKEN }}
        ci-command: 'bash ./build.sh'
```

# Input

| option                 | type    | required                              | default      | description                                                  |
| ---------------------- | ------- | ------------------------------------- | ------------ | ------------------------------------------------------------ |
| send-to-dingtalk-group | boolean | No                                    | false        | Boolean. Set to true if it needs to send merge info to ding talk group. If true then dingtalk-access-token and dingtalk-secret are required. |
| dingtalk-access-token  | string  | Yes if send-to-dingtalk-group is true | Empty string | Dingtalk bot access token.                                   |
| dingtalk-secret        | string  | Yes if send-to-dingtalk-group is true | Empty string | Dingtalk secret.                                             |
| maintainer-team-name   | string  | Yes                                   | None         | Name of maintainer team.                                     |
| gh-token               | string  | Yes                                   | None         | Github Token                                                 |
| ci-command             | string  | No                                    | None         | The command to use for running test.                         |

## Output

| option     | type    | description                                                  |
| ---------- | ------- | ------------------------------------------------------------ |
| merge-info | string  | Final merge info.                                            |
| error-log  | string  | Error log if build failed with the command passed in inputs. |
| pass-log   | string  | Log if build passed with the command passed in inputs.       |
| merged     | boolean | Boolean, true if any pr merged.                              |
