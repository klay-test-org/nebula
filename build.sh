if [ $(( ( RANDOM % 10 ) % 2 ))  == 0 ]; then
    echo "build passed";
    exit 0;
else
    echo "build failed";
    exit 1;
fi