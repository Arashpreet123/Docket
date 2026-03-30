from rest_framework import serializers
from .models import Event


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'source', 'type', 'value', 'timestamp', 'alert']
        read_only_fields = ['id', 'timestamp', 'alert']