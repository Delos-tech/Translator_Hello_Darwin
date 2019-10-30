#! /bin/bash
IMAGE_NAME=$1
IMAGE_VERSION=$2

if [[ -z "$IMAGE_NAME" || -z "$IMAGE_VERSION" ]]; then
    echo "Usage: ./update-docker.sh IMAGE_NAME IMAGE_VERSION"
    exit 125
fi

REPO=docker.webbylab.com
IMAGE_ID=`docker images | grep "$REPO/$IMAGE_NAME" | awk '{print $3}'`

if ! [ -z "$IMAGE_ID" ]; then
    echo Found image $IMAGE_ID with name $IMAGE_NAME locally.
    echo ================================================================================
    echo REMOVING...
    echo ================================================================================
    docker rmi $IMAGE_ID -f
    echo ================================================================================
    echo REMOVED
    echo ================================================================================
fi
echo BUILDING NEW IMAGE...
echo ================================================================================
docker build -t $IMAGE_NAME .
echo ================================================================================
echo BUILD COMPLETED
echo ================================================================================
echo PUSHING TO DOCKER-REGISTRY...
echo ================================================================================
docker tag $IMAGE_NAME $REPO/$IMAGE_NAME:$IMAGE_VERSION
docker push $REPO/$IMAGE_NAME:$IMAGE_VERSION
echo ================================================================================
echo PUSH COMPLETED
echo ================================================================================
