const github = require('@actions/github');
const repo = github.context.repo;
const exec = require('@actions/exec');
const core = require('@actions/core');
const q = require('q');
const striptags = require('striptags');
const async = require("async");
const ChatBot = require('dingtalk-robot-sender');
const fs = require('fs');

const repoName = repo.repo;
const ownerName = repo.owner;
const octokit = github.getOctokit(core.getInput('gh-token'));
const maintainerTeamName = core.getInput('maintainer-team-name');
const dingtalkAccessToken = core.getInput('dingtalk-access-token');
const dingtalkSecret = core.getInput('dingtalk-secret');
const ci = core.getInput('ci-command');

const robot = new ChatBot({
    webhook: `https://oapi.dingtalk.com/robot/send?access_token=${dingtalkAccessToken}`,
    secret: dingtalkSecret
});

let mergeablePr = {};
let failedToMerge = [];
let succeedToMerge = [];
let errorLog = "";
let passLog = "";

const execOptions = {};
execOptions.ignoreReturnCode = true;
execOptions.listeners = {
    stdout: (data) => {
        passLog += data.toString();
    },
    stderr: (data) => {
        errorLog += data.toString();
    }
};

function main() {
    q.all([getAllMaintainers(),getAllOpenPrs()])
    .then(getMergeablePrs)
    .then(() => {
        if (Object.keys(mergeablePr).length) {
            return getAllPatchesAndApply()
            .then(runTest)
            .then(mergeValidPr)
            .then(sendMergeInfoToDingtalk);
        }
    })
    .then(setOutputInfoAndCleanup)
    .done();
}
  
if (require.main === module) {
    main();
}

async function getAllMaintainers() {
    return octokit.rest.teams.listMembersInOrg({
        org: ownerName,
        team_slug: maintainerTeamName,
        role: 'maintainer'
    }).then(res => {
        let maintainerList = [];
        res.data.forEach(maintainer => maintainerList.push(maintainer.login));
        return maintainerList;
    });
}

async function getAllOpenPrs() {
    return octokit.rest.search.issuesAndPullRequests({
        q: `is:pr+is:open+repo:${ownerName}/${repoName}+review:approved`
    }).then(res => {
        return res.data.items;
    });
}

async function mergeValidPr() {
    console.log(mergeablePr);
    console.log("number of merge:" + Object.keys(mergeablePr).length);
    let promises = [];
    const defer = q.defer();
    for (const [prNum, pr] of Object.entries(mergeablePr)) {
        console.log(prNum);
        // promises.push(
        //     octokit.rest.pulls.merge({
        //         owner: ownerName,
        //         repo: repoName,
        //         merge_method: 'squash',
        //         pull_number: prNum
        //     })
        //     .then(response => {
        //         console.log(response.status);
        //         if (response.status != '200') {
        //             failedToMerge.push(pr.html_url);
        //             delete mergeablePr[prNum];
        //         }
        //     })
        // );
    }
    q.all(promises).then(() => {
        console.log("merged");
        console.log(mergeablePr);
        console.log(failedToMerge);
        defer.resolve();
    })
    return defer.promise;
}

async function getMergeablePrs(res) {
    const maintainerList = res[0];
    const prs = res[1];
    const defer = q.defer();
    let promises = [];
    prs.forEach((pr) => {
        promises.push(
            octokit.request('GET ' + pr.comments_url)
            .then(comments => {
                let mergeable = false;
                comments.data.forEach(comment => { 
                    const body = striptags(comment.body).trim();
                    if (body === "/merge" && maintainerList.includes(comment.user.login)) {
                        mergeable = true;
                    } else if (body === "/wait a minute" && maintainerList.includes(comment.user.login)) {
                        mergeable = false;
                    }
                });
                if (mergeable) {
                    mergeablePr[pr.number] = {number: pr.number, html_url: pr.html_url, patch_url: pr.pull_request.patch_url};
                }
            })
        );
    })
    q.all(promises).then(() => {
        defer.resolve();
    });
    return defer.promise;
}

async function runTest() {

    let defer = q.defer();

    const getRandomInt = (max) => {
        return Math.floor(Math.random() * max);
    }

    const run =  (returnCode) => {
        console.log("returnCode" + returnCode);
        if (!returnCode || !Object.keys(mergeablePr).length) {
            return defer.resolve();
        }

        if (returnCode) {
            const kickout = getRandomInt(Object.keys(mergeablePr).length);
            const pr = mergeablePr[Object.keys(mergeablePr)[kickout]];
            failedToMerge.push(pr.html_url);
            delete mergeablePr[pr.number];
            return exec.exec(`git apply -R ${pr.number}.patch`, [], execOptions)
                .then(() => exec.exec(ci, [], execOptions))
                .then(run);
        }
    };

    exec.exec(ci, [], execOptions)
    .then(run);
    return defer.promise;
}

async function sendMergeInfoToDingtalk() {
    for (const [key, value] of Object.entries(mergeablePr)) {
        succeedToMerge.push(value.html_url);
    }
    if (succeedToMerge.length > 0 || failedToMerge.length > 0) {
        let title = "merge info";
        let text = "## merge info\n" +
        "> merge successfully:\n" +
        "> " + succeedToMerge.join(', ') + "\n\n"  +
        "> failed to merge: \n" +
        "> " + failedToMerge.join(', ') + "\n";
        let at = {
            // "atMobiles": phone, 
            "isAtAll": false
        };;
        return robot.markdown(title,text,at);
    }    
}

async function getAllPatchesAndApply() {
    let promises = [];
    const defer = q.defer();
    for (const [prNum, pr] of Object.entries(mergeablePr)) {
        promises.push(
            octokit.request(`GET ${pr.patch_url}`)
            .then(response => {
                fs.writeFileSync(`${prNum}.patch`, response.data);
                mergeablePr[prNum]["patchFile"] = `${prNum}.patch`;
            })
            .then(() => exec.exec(`git apply --reject --whitespace=fix ${prNum}.patch`, [], execOptions))
            .then(returnCode => {
                if (returnCode != 0) {
                    failedToMerge.push(pr.html_url);
                    delete mergeablePr[pr.number];
                }
            })
        );
    }
    q.all(promises).then(() => {
        defer.resolve();
    });
    return defer.promise;
}

async function setOutputInfoAndCleanup() {
    console.log("setting output");
    console.log(mergeablePr);
    console.log(failedToMerge);
    core.setOutput("merged", Object.keys(mergeablePr).length > 0);
    core.setOutput("error-log", errorLog);
    core.setOutput("pass-log", passLog);
    core.setOutput("merge-info", Object.keys(mergeablePr).length > 0 ? 
        "merge successfully:\n" + succeedToMerge.join(', ') + "\n\n" + "failed to merge: \n" + failedToMerge.join(', ') + "\n" : 
        "not any pr was merged");
    return exec.exec(`rm -rf *.patch`, [], execOptions);
}